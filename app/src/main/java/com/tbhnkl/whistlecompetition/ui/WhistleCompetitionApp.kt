package com.tbhnkl.whistlecompetition.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tbhnkl.whistlecompetition.CompetitionViewModel
import com.tbhnkl.whistlecompetition.GamePhase
import com.tbhnkl.whistlecompetition.R

@Composable
fun WhistleCompetitionApp(
    hasMicPermission: Boolean,
    micPermissionDeniedEvent: Int,
    onRequestMicPermission: () -> Unit,
    viewModel: CompetitionViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    val deniedMessage = stringResource(R.string.setup_mic_permission_denied)

    LaunchedEffect(micPermissionDeniedEvent) {
        if (micPermissionDeniedEvent > 0) {
            snackbarHostState.currentSnackbarData?.dismiss()
            snackbarHostState.showSnackbar(deniedMessage)
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) }
        ) { padding ->
            Surface(modifier = Modifier.fillMaxSize().padding(padding)) {
                when (uiState.phase) {
                    GamePhase.SETUP -> SetupScreen(
                        playerCount = uiState.playerCount,
                        playerNames = uiState.playerNames,
                        onPlayerCountChange = viewModel::setPlayerCount,
                        onPlayerNameChange = viewModel::updatePlayerName,
                        onStartClick = {
                            if (hasMicPermission) {
                                viewModel.startCompetition()
                            } else {
                                onRequestMicPermission()
                            }
                        }
                    )
                    GamePhase.TURN -> {
                        val currentPlayer = uiState.currentPlayer
                        if (currentPlayer != null) {
                            TurnScreen(
                                playerName = currentPlayer.name,
                                isRecording = uiState.isRecording,
                                liveFrequency = uiState.liveFrequency,
                                hasResult = uiState.hasResult,
                                lastResult = uiState.lastResult,
                                isLastPlayer = uiState.isLastPlayer,
                                onStartRecording = {
                                    if (hasMicPermission) {
                                        viewModel.startRecording()
                                    } else {
                                        onRequestMicPermission()
                                    }
                                },
                                onNextPlayer = viewModel::nextPlayer
                            )
                        }
                    }
                    GamePhase.RESULTS -> ResultsScreen(
                        players = uiState.players,
                        onRestart = viewModel::restart
                    )
                }
            }
        }
    }
}
