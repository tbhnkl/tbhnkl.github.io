package com.tbhnkl.whistlecompetition

data class Player(
    val id: Int,
    val name: String,
    val score: Float? = null
)

enum class GamePhase {
    SETUP, TURN, RESULTS
}

data class CompetitionUiState(
    val phase: GamePhase = GamePhase.SETUP,
    val playerCount: Int = 2,
    val playerNames: List<String> = listOf("שחקן 1", "שחקן 2"),
    val players: List<Player> = emptyList(),
    val currentPlayerIndex: Int = 0,
    val isRecording: Boolean = false,
    val liveFrequency: Float? = null,
    val hasResult: Boolean = false,
    val lastResult: Float? = null
) {
    val currentPlayer: Player?
        get() = players.getOrNull(currentPlayerIndex)

    val isLastPlayer: Boolean
        get() = currentPlayerIndex == players.lastIndex
}

object CompetitionRules {
    const val MIN_PLAYERS = 2
    const val MAX_PLAYERS = 20
    const val RECORD_DURATION_MS = 4000L
}
