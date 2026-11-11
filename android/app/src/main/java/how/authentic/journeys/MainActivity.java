package how.authentic.journeys;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DownloadKeepAlivePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
