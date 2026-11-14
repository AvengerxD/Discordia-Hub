package __APP_ID__;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

// Serviço em primeiro plano: mantém o app vivo (com a notificação visível) enquanto o microfone ou a câmera estão ligados.
public class CallService extends Service {
  static final String CANAL = "discordiahub_call";
  static final int ID = 4731;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    boolean camera = intent != null && intent.getBooleanExtra("camera", false);
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    if (Build.VERSION.SDK_INT >= 26 && nm != null) {
      NotificationChannel c = new NotificationChannel(CANAL, "Call em andamento", NotificationManager.IMPORTANCE_LOW);
      nm.createNotificationChannel(c);
    }
    Intent abrir = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pi = PendingIntent.getActivity(this, 0, abrir, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CANAL) : new Notification.Builder(this);
    Notification n = b
        .setContentTitle("DiscórdiaHub")
        .setContentText(camera ? "Microfone e câmera ATIVOS. Toque para abrir." : "Microfone ATIVO. Toque para abrir.")
        .setSmallIcon(android.R.drawable.ic_btn_speak_now)
        .setContentIntent(pi)
        .setOngoing(true)
        .build();
    if (Build.VERSION.SDK_INT >= 30) {
      int tipo = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
      if (camera) tipo |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
      startForeground(ID, n, tipo);
    } else {
      startForeground(ID, n);
    }
    return START_NOT_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
