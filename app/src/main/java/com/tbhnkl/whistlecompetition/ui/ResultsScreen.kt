package com.tbhnkl.whistlecompetition.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
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
import com.tbhnkl.whistlecompetition.Player
import com.tbhnkl.whistlecompetition.R

// Same validated "emphasis" pair as the web app's --bar-muted token: a
// desaturated gray-blue for every non-winner bar, so the gold winner bar
// is unambiguously the one thing the chart draws attention to.
private val BarMutedLight = Color(0xFF7C8BAE)
private val BarMutedDark = Color(0xFF5B6B85)

@Composable
fun ResultsScreen(
    players: List<Player>,
    onRestart: () -> Unit
) {
    val ranked = players.sortedByDescending { it.score ?: -1f }
    val winner = ranked.firstOrNull { it.score != null }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
    ) {
        Text(
            text = stringResource(R.string.results_title),
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (winner != null) {
            Text(
                text = stringResource(R.string.results_winner, winner.name, winner.score!!.toInt()),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.fillMaxWidth()
            )
        } else {
            Text(
                text = stringResource(R.string.results_no_scores),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        val maxScore = winner?.score

        LazyColumn(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            items(ranked.size) { index ->
                val player = ranked[index]
                val isWinner = winner != null && player.id == winner.id
                ResultBarRow(rank = index + 1, player = player, isWinner = isWinner, maxScore = maxScore)
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onRestart,
            modifier = Modifier.fillMaxWidth().height(56.dp)
        ) {
            Text(stringResource(R.string.results_restart_button), style = MaterialTheme.typography.titleMedium)
        }
    }
}

private fun rankLabel(rank: Int, hasScore: Boolean): String = when {
    !hasScore -> "$rank."
    rank == 1 -> "🥇"
    rank == 2 -> "🥈"
    rank == 3 -> "🥉"
    else -> "$rank."
}

@Composable
private fun ResultBarRow(
    rank: Int,
    player: Player,
    isWinner: Boolean,
    maxScore: Float?,
    modifier: Modifier = Modifier
) {
    val hasScore = player.score != null
    val targetFraction = if (hasScore && maxScore != null && maxScore > 0f) {
        (player.score!! / maxScore).coerceIn(0f, 1f).coerceAtLeast(0.04f)
    } else {
        0f
    }
    val animatedFraction by animateFloatAsState(
        targetValue = targetFraction,
        animationSpec = tween(durationMillis = 700, easing = FastOutSlowInEasing),
        label = "resultBarFraction"
    )
    val barColor = if (isWinner) {
        MaterialTheme.colorScheme.secondary
    } else if (isSystemInDarkTheme()) {
        BarMutedDark
    } else {
        BarMutedLight
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = rankLabel(rank, hasScore),
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.padding(end = 6.dp)
                )
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = if (isWinner) FontWeight.Bold else FontWeight.SemiBold
                )
            }
            Text(
                text = if (hasScore) stringResource(R.string.turn_result_frequency, player.score!!.toInt()) else "—",
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Bold
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(26.dp)
                .clip(RoundedCornerShape(13.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxHeight()
                    .fillMaxWidth(animatedFraction)
                    .clip(RoundedCornerShape(13.dp))
                    .background(barColor)
            )
        }
    }
}
