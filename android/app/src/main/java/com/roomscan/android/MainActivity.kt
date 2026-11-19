package com.roomscan.android

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.roomscan.android.capture.CaptureScreen
import com.roomscan.android.projects.ProjectsScreen
import com.roomscan.android.review.ReviewScreen
import com.roomscan.core.SurveyProject
import java.util.UUID

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent { RoomScanTheme { AppNavigation() } }
    }
}

@Composable
fun RoomScanTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) darkColorScheme(primary = Color(0xFF5AA9FF)) else lightColorScheme(primary = Color(0xFF0A7AFF))
    MaterialTheme(colorScheme = scheme) { Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) { content() } }
}

@Composable
private fun AppNavigation() {
    val nav = rememberNavController()
    NavHost(nav, startDestination = "projects") {
        composable("projects") {
            ProjectsScreen(
                onOpen = { id -> nav.navigate("review/$id") },
                onCapture = { id -> nav.navigate("capture/$id") },
            )
        }
        composable("capture/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
            WithProject(entry.arguments?.getString("id")) { project ->
                CaptureScreen(
                    project = project,
                    onFinished = { p -> nav.navigate("review/${p.id}") { popUpTo("projects") } },
                    onCancel = { nav.popBackStack() },
                )
            }
        }
        composable("review/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
            WithProject(entry.arguments?.getString("id")) { project ->
                ReviewScreen(
                    initial = project,
                    onBack = { nav.popBackStack("projects", inclusive = false) },
                    onCapture = { nav.navigate("capture/${project.id}") },
                )
            }
        }
    }
}

/** Loads a project by id from disk before showing [content]; shows an error if it can't be read. */
@Composable
private fun WithProject(id: String?, content: @Composable (SurveyProject) -> Unit) {
    val repo = LocalContext.current.repository
    var project by remember(id) { mutableStateOf<SurveyProject?>(null) }
    var failed by remember(id) { mutableStateOf<String?>(null) }
    LaunchedEffect(id) {
        runCatching { repo.load(UUID.fromString(id)) }.onSuccess { project = it }.onFailure { failed = it.message ?: it.toString() }
    }
    val p = project
    when {
        p != null -> content(p)
        failed != null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(stringResource(R.string.projects_load_failed) + "\n" + failed) }
        else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
    }
}
