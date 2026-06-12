// PracticeCarAppService.kt — Practice Vision on Android Auto (Navigation category)
//
// Dependency: androidx.car.app:app:1.4.0  (see build.gradle.snippet)
// Declare the service in AndroidManifest (see AndroidManifest.snippet.xml).
// Test with the Desktop Head Unit (DHU): adb forward tcp:5277 tcp:5277

package fm.betterstate.practice.car

import androidx.car.app.CarAppService
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.model.Action
import androidx.car.app.model.CarColor
import androidx.car.app.model.Distance
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.validation.HostValidator

class PracticeCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator =
        HostValidator.ALLOW_ALL_HOSTS_VALIDATOR // tighten before shipping

    override fun onCreateSession(): Session = object : Session() {
        override fun onCreateScreen(intent: android.content.Intent): Screen =
            NavigationScreen(carContext)
    }
}

class NavigationScreen(carContext: CarContext) : Screen(carContext) {

    // these would be driven by the agent-os graph (risk/nav nodes) over a WebSocket / local service
    private var risk: Float = 0f
    private var safetyAlert: String? = null

    override fun onGetTemplate(): Template {
        val step = Step.Builder("Continuez sur l'A86")
            .setManeuver(Maneuver.Builder(Maneuver.TYPE_STRAIGHT).build())
            .build()

        val routingInfo = RoutingInfo.Builder()
            .setCurrentStep(step, Distance.create(800.0, Distance.UNIT_METERS))
            .build()

        val builder = NavigationTemplate.Builder()
            .setNavigationInfo(routingInfo)
            .setActionStrip(
                androidx.car.app.model.ActionStrip.Builder()
                    .addAction(Action.Builder().setTitle("Favoris").setOnClickListener { showFavourites() }.build())
                    .build()
            )

        // Safety override from the risk engine → red banner
        safetyAlert?.let { builder.setBackgroundColor(CarColor.RED) }

        return builder.build()
    }

    fun onAgentUpdate(risk: Float, alert: String?) {
        this.risk = risk; this.safetyAlert = alert
        invalidate() // re-render template
    }

    private fun showFavourites() { /* push a ListTemplate of favourites (mirrors os.html favs) */ }
}
