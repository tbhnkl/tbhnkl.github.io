package com.tbhnkl.whistlecompetition.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Blue = Color(0xFF1A73E8)
private val BlueDark = Color(0xFF0D47A1)
private val Amber = Color(0xFFFFB300)

private val LightColors = lightColorScheme(
    primary = Blue,
    secondary = Amber,
    tertiary = BlueDark
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF82B1FF),
    secondary = Amber,
    tertiary = Color(0xFF90CAF9)
)

@Composable
fun WhistleCompetitionTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colors = if (darkTheme) DarkColors else LightColors
    MaterialTheme(
        colorScheme = colors,
        content = content
    )
}
