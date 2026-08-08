package com.tbhnkl.whistlecompetition.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.tbhnkl.whistlecompetition.Player
import com.tbhnkl.whistlecompetition.R

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

        Row(modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)) {
            Text(
                text = stringResource(R.string.results_table_place),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.weight(0.6f)
            )
            Text(
                text = stringResource(R.string.results_table_name),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.weight(1.4f)
            )
            Text(
                text = stringResource(R.string.results_table_frequency),
                style = MaterialTheme.typography.labelLarge,
                modifier = Modifier.weight(1f),
                textAlign = TextAlign.End
            )
        }
        HorizontalDivider()

        LazyColumn(modifier = Modifier.weight(1f)) {
            items(ranked.size) { index ->
                val player = ranked[index]
                val isWinner = winner != null && player.id == winner.id
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(
                            if (isWinner) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                            RoundedCornerShape(8.dp)
                        )
                        .padding(vertical = 12.dp, horizontal = 4.dp)
                ) {
                    Text(
                        text = "${index + 1}",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isWinner) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.weight(0.6f)
                    )
                    Text(
                        text = player.name,
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isWinner) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.weight(1.4f)
                    )
                    Text(
                        text = player.score?.toInt()?.toString() ?: "—",
                        style = MaterialTheme.typography.bodyLarge,
                        fontWeight = if (isWinner) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.End
                    )
                }
                HorizontalDivider()
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
