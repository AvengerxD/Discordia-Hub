package __APP_ID__;

import androidx.core.content.FileProvider;

// Subclasse só para ter um nome próprio no manifesto: o Capacitor já declara o FileProvider padrão,
// e dois <provider> com a mesma classe dão conflito na hora de montar o app.
public class UpdateFileProvider extends FileProvider {}
