package com.tbhnkl.whistlecompetition

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import com.tbhnkl.whistlecompetition.ui.WhistleCompetitionApp
import com.tbhnkl.whistlecompetition.ui.theme.WhistleCompetitionTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            var hasMicPermission by remember { mutableStateOf(isMicPermissionGranted()) }
            var deniedEvent by remember { mutableIntStateOf(0) }

            val permissionLauncher = androidx.activity.compose.rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission()
            ) { granted ->
                hasMicPermission = granted
                if (!granted) deniedEvent++
            }

            WhistleCompetitionTheme {
                WhistleCompetitionApp(
                    hasMicPermission = hasMicPermission,
                    micPermissionDeniedEvent = deniedEvent,
                    onRequestMicPermission = { permissionLauncher.launch(Manifest.permission.RECORD_AUDIO) }
                )
            }
        }
    }

    private fun isMicPermissionGranted(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
}
