package __APP_ID__;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

// Ponte entre o sala.html (Capacitor.Plugins.CallService) e o serviço em primeiro plano.
@CapacitorPlugin(
    name = "CallService",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notificacoes") })
public class CallServicePlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notificacoes") != PermissionState.GRANTED) {
      requestPermissionForAlias("notificacoes", call, "aposPermissao");
    } else {
      iniciar(call);
    }
  }

  @PermissionCallback
  private void aposPermissao(PluginCall call) {
    iniciar(call); // mesmo sem a permissão da notificação o serviço roda; só o aviso fica escondido
  }

  private void iniciar(PluginCall call) {
    try {
      Intent i = new Intent(getContext(), CallService.class);
      i.putExtra("camera", Boolean.TRUE.equals(call.getBoolean("camera", false)));
      if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i);
      else getContext().startService(i);
      call.resolve();
    } catch (Exception e) {
      call.reject("Não foi possível iniciar o serviço: " + e.getMessage());
    }
  }

  @PluginMethod
  public void stop(PluginCall call) {
    getContext().stopService(new Intent(getContext(), CallService.class));
    call.resolve();
  }
}
