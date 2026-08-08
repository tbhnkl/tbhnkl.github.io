package com.tbhnkl.whistlecompetition

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tbhnkl.whistlecompetition.audio.AudioCapture
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class CompetitionViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(CompetitionUiState())
    val uiState: StateFlow<CompetitionUiState> = _uiState.asStateFlow()

    private val audioCapture = AudioCapture()
    private var recordingJob: Job? = null

    fun setPlayerCount(count: Int) {
        val clamped = count.coerceIn(CompetitionRules.MIN_PLAYERS, CompetitionRules.MAX_PLAYERS)
        _uiState.update { current ->
            val names = List(clamped) { i -> current.playerNames.getOrElse(i) { "שחקן ${i + 1}" } }
            current.copy(playerCount = clamped, playerNames = names)
        }
    }

    fun updatePlayerName(index: Int, name: String) {
        _uiState.update { current ->
            if (index !in current.playerNames.indices) return@update current
            val names = current.playerNames.toMutableList().apply { this[index] = name }
            current.copy(playerNames = names)
        }
    }

    fun startCompetition() {
        _uiState.update { current ->
            val players = current.playerNames.mapIndexed { i, name ->
                Player(id = i, name = name.ifBlank { "שחקן ${i + 1}" })
            }
            current.copy(phase = GamePhase.TURN, players = players, currentPlayerIndex = 0, lastResult = null)
        }
    }

    fun startRecording() {
        if (_uiState.value.isRecording) return
        recordingJob = viewModelScope.launch {
            _uiState.update { it.copy(isRecording = true, liveFrequency = null, hasResult = false, lastResult = null) }

            val best = audioCapture.record(CompetitionRules.RECORD_DURATION_MS) { freq ->
                _uiState.update { it.copy(liveFrequency = freq) }
            }

            _uiState.update { current ->
                val index = current.currentPlayerIndex
                val updatedPlayers = current.players.toMutableList()
                if (index in updatedPlayers.indices) {
                    updatedPlayers[index] = updatedPlayers[index].copy(score = best)
                }
                current.copy(
                    isRecording = false,
                    players = updatedPlayers,
                    hasResult = true,
                    lastResult = best,
                    liveFrequency = null
                )
            }
        }
    }

    fun nextPlayer() {
        _uiState.update { current ->
            val next = current.currentPlayerIndex + 1
            if (next >= current.players.size) {
                current.copy(phase = GamePhase.RESULTS)
            } else {
                current.copy(currentPlayerIndex = next, hasResult = false, lastResult = null)
            }
        }
    }

    fun restart() {
        recordingJob?.cancel()
        recordingJob = null
        _uiState.value = CompetitionUiState()
    }

    override fun onCleared() {
        recordingJob?.cancel()
        super.onCleared()
    }
}
