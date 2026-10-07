package app.netlify.franmotest;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import android.util.Base64;
import org.json.JSONObject;
import java.io.File;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;

/** Debug-only instrumentation of the real updater verification boundary. */
public final class UpdateVerificationTest extends Instrumentation {
    private Bundle arguments;
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); this.arguments = arguments; start(); }
    @Override public void onStart() {
        Bundle result = new Bundle(); AppUpdater verifier = null;
        try {
            MainActivity activity = (MainActivity) startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            verifier = new AppUpdater(activity);
            JSONObject metadata = new JSONObject(new String(Base64.decode(arguments.getString("manifest"), Base64.DEFAULT), StandardCharsets.UTF_8));
            File file = new File(getTargetContext().getFilesDir(), "updates/" + arguments.getString("file"));
            Method method = AppUpdater.class.getDeclaredMethod("verify", File.class, JSONObject.class); method.setAccessible(true);
            String observed = "accepted";
            try { method.invoke(verifier, file, metadata); }
            catch (InvocationTargetException e) { observed = e.getCause().getMessage(); }
            if (!arguments.getString("expected").equals(observed)) throw new AssertionError("Expected " + arguments.getString("expected") + ", got " + observed);
            result.putString("result", observed); finish(Activity.RESULT_OK, result);
        } catch (Throwable error) { result.putString("error", error.toString()); finish(Activity.RESULT_CANCELED, result); }
        finally { if (verifier != null) verifier.close(); }
    }
}
