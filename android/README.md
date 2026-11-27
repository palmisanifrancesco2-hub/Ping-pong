# Ping Pong Analytics per Android

L’APK aggiunge un’icona Android per aprire Ping Pong Analytics. Usa una scheda del browser, così il login Google avviene nel browser e l’app raggiunge Vercel, MoviOdds e Supabase tramite lo stesso sito. Serve Android 7 o successivo, un browser e una connessione Internet. L’APK punta all’indirizzo di produzione e riceve gli aggiornamenti web quando l’app viene ricaricata.

Per installarlo, scarica `Ping-Pong-Analytics.apk` sul telefono e aprilo. Se Android chiede il permesso, abilita «Consenti da questa fonte» per il browser o per l’app File che ha aperto l’APK. Avvia «Ping Pong Analytics» e accedi come sul sito.

## Build

Usare Android SDK Platform 35, Build Tools 35, Java 21, `zip` e una chiave di firma privata con alias `ping-pong-analytics`. Impostare `PPA_BUILD_TOOLS`, `PPA_ANDROID_JAR`, `PPA_KEYSTORE` e `PPA_KEYSTORE_PASSWORD`. La compilazione usa `javac` o il compilatore Eclipse se la variabile `PPA_ECJ` punta al suo JAR.

```bash
bash android/build-apk.sh
```

La build verifica la firma e stampa il checksum SHA-256. Per installare aggiornamenti sullo stesso pacchetto Android, incrementare `versionCode` e usare la stessa chiave di firma. Tenere chiave e password in un archivio privato.
