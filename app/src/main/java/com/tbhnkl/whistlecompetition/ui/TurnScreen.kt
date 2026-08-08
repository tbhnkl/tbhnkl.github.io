package com.tbhnkl.whistlecompetition.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tbhnkl.whistlecompetition.R

@Composable
fun TurnScreen(
    playerName: String,
    isRecording: Boolean,
    liveFrequency: Float?,
    hasResult: Boolean,
    lastResult: Float?,
    isLastPlayer: Boolean,
    onStartRecording: () -> Unit,
    onNextPlayer: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = stringResource(R.string.turn_title, playerName),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(16.dp))

        when {
            hasResult -> {
                Text(
                    text = stringResource(R.string.turn_result_label, playerName),
                    style = MaterialTheme.typography.titleMedium
                )
                if (lastResult != null) {
                    Text(
                        text = stringResource(R.string.turn_result_frequency, lastResult.toInt()),
                        style = MaterialTheme.typography.displayLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                } else {
                    Text(
                        text = stringResource(R.string.turn_result_no_whistle),
                        style = MaterialTheme.typography.titleLarge,
                        color = Color(0xFFB00020),
                        textAlign = TextAlign.Center
                    )
                }
            }
            isRecording -> {
                Box(
                    modifier = Modifier
                        .fillMaxWidth(0.6f)
                        .aspectRatio(1f)
                        .clip(CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(modifier = Modifier.fillMaxSize())
                    Text(
                        text = liveFrequency?.let { stringResource(R.string.turn_live_frequency, it.toInt()) }
                            ?: stringResource(R.string.turn_no_signal),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
                Text(
                    text = stringResource(R.string.turn_recording_label),
                    style = MaterialTheme.typography.bodyLarge,
                    modifier = Modifier.padding(top = 16.dp)
                )
            }
            else -> {
                Text(
                    text = stringResource(R.string.turn_instructions),
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center
                )
            }
        }

        androidx.compose.foundation.layout.Spacer(modifier = Modifier.height(32.dp))

        AnimatedVisibility(visible = !isRecording && !hasResult) {
            Button(
                onClick = onStartRecording,
                modifier = Modifier.fillMaxWidth().height(56.dp)
            ) {
                Text(stringResource(R.string.turn_start_button), style = MaterialTheme.typography.titleMedium)
            }
        }

        AnimatedVisibility(visible = !isRecording && hasResult) {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                OutlinedButton(
                    onClick = onStartRecording,
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text(stringResource(R.string.turn_retry_button))
                }
                Button(
                    onClick = onNextPlayer,
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                ) {
                    Text(
                        text = if (isLastPlayer) stringResource(R.string.turn_finish_button) else stringResource(R.string.turn_next_button),
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }
        }
    }
}
