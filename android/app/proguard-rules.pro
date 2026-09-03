# Academy Sales CRM ProGuard Rules

# ─── WebView JavaScript Interface ───────────────────────────────────────────────
# Keep all @JavascriptInterface annotated methods so WebView JS bridge works after minification
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.academysales.crm.MainActivity$WebAppInterface { *; }
-keepclassmembers class com.academysales.crm.MainActivity$WebAppInterface { *; }

# ─── Telecom / InCallService ────────────────────────────────────────────────────
-keep class com.academysales.crm.telecom.** { *; }

# ─── AndroidX WebKit / WebView ──────────────────────────────────────────────────
-keep class androidx.webkit.** { *; }
-dontwarn androidx.webkit.**

# ─── AppCompat ──────────────────────────────────────────────────────────────────
-keep class androidx.appcompat.** { *; }

# ─── General Android safety ─────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver

# ─── Suppress warnings for optional dependencies ────────────────────────────────
-dontwarn kotlin.**
-dontwarn org.slf4j.**
