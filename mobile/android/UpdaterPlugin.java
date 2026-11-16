package __APP_ID__;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONArray;
import org.json.JSONObject;

// Atualização automática do APK: consulta a última Release do GitHub, baixa o APK novo e abre o instalador do Android.
// A rede é feita aqui no lado nativo, então a política de segurança (CSP) do sala.html não precisa mudar.
// O Android sempre pede uma confirmação ("Atualizar?") ao usuário: não existe instalação 100% silenciosa fora da Play Store.
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {
  static final String DONO = "__GH_OWNER__";
  static final String REPO = "__GH_REPO__";
  static final String NOME_APK = "DiscordiaHub-Android.apk";

  private volatile String urlApk = null;
  private volatile String versaoNova = null;

  private String versaoAtual() throws Exception {
    PackageInfo pi = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
    return pi.versionName == null ? "0" : pi.versionName;
  }

  // Compara "1.6.10" com "1.6.9" número a número.
  static int comparar(String a, String b) {
    String[] x = a.replaceFirst("^v", "").split("[.-]");
    String[] y = b.replaceFirst("^v", "").split("[.-]");
    for (int i = 0; i < Math.max(x.length, y.length); i++) {
      int p = i < x.length ? num(x[i]) : 0, q = i < y.length ? num(y[i]) : 0;
      if (p != q) return p < q ? -1 : 1;
    }
    return 0;
  }

  static int num(String s) {
    try { return Integer.parseInt(s.replaceAll("[^0-9]", "")); } catch (Exception e) { return 0; }
  }

  private HttpURLConnection abrir(String endereco) throws Exception {
    HttpURLConnection c = (HttpURLConnection) new URL(endereco).openConnection();
    c.setConnectTimeout(10000);
    c.setReadTimeout(20000);
    c.setInstanceFollowRedirects(true);
    c.setRequestProperty("User-Agent", "DiscordiaHub-Android");
    c.setRequestProperty("Accept", "application/vnd.github+json");
    return c;
  }

  @PluginMethod
  public void check(final PluginCall call) {
    if (DONO.startsWith("__") || REPO.startsWith("__")) {
      call.reject("repositorio-nao-configurado");
      return;
    }
    new Thread(() -> {
      try {
        HttpURLConnection c = abrir("https://api.github.com/repos/" + DONO + "/" + REPO + "/releases/latest");
        if (c.getResponseCode() != 200) { call.reject("sem-release"); return; }
        StringBuilder sb = new StringBuilder();
        try (InputStream in = c.getInputStream()) {
          byte[] b = new byte[8192]; int n;
          while ((n = in.read(b)) > 0) sb.append(new String(b, 0, n, "UTF-8"));
        }
        JSONObject r = new JSONObject(sb.toString());
        String tag = r.optString("tag_name", "");
        String url = null;
        JSONArray assets = r.optJSONArray("assets");
        if (assets != null) for (int i = 0; i < assets.length(); i++) {
          JSONObject a = assets.getJSONObject(i);
          if (NOME_APK.equals(a.optString("name"))) { url = a.optString("browser_download_url"); break; }
        }
        String atual = versaoAtual();
        boolean nova = url != null && !tag.isEmpty() && comparar(tag, atual) > 0;
        if (nova) { urlApk = url; versaoNova = tag.replaceFirst("^v", ""); }
        JSObject o = new JSObject();
        o.put("available", nova);
        o.put("current", atual);
        o.put("version", tag.replaceFirst("^v", ""));
        call.resolve(o);
      } catch (Exception e) {
        call.reject("falha-rede");
      }
    }).start();
  }

  @PluginMethod
  public void install(final PluginCall call) {
    final String url = urlApk;
    if (url == null || !url.startsWith("https://")) { call.reject("sem-atualizacao"); return; }
    // Android 8+: o usuário precisa liberar "instalar apps desconhecidos" para o DiscórdiaHub (uma vez).
    if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
      Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
      i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getContext().startActivity(i);
      call.reject("permissao");
      return;
    }
    new Thread(() -> {
      try {
        File dir = new File(getContext().getCacheDir(), "updates");
        dir.mkdirs();
        File apk = new File(dir, NOME_APK);
        HttpURLConnection c = abrir(url);
        c.setReadTimeout(60000);
        if (c.getResponseCode() != 200) { call.reject("falha-download"); return; }
        try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
          byte[] b = new byte[16384]; int n;
          while ((n = in.read(b)) > 0) out.write(b, 0, n);
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updates", apk);
        Intent i = new Intent(Intent.ACTION_VIEW);
        i.setDataAndType(uri, "application/vnd.android.package-archive");
        i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
      } catch (Exception e) {
        call.reject("falha-download");
      }
    }).start();
  }
}
