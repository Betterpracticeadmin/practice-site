// CarPlaySceneDelegate.swift — Practice Vision CarPlay scene (Navigation category)
//
// Requires the CarPlay Navigation entitlement: com.apple.developer.carplay-maps
// (requested from Apple Developer portal, reviewed by Apple).
// Build & test in Xcode → I/O → External Displays → CarPlay (simulator).

import CarPlay
import MapKit

final class CarPlaySceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {

    var interfaceController: CPInterfaceController?
    var mapTemplate: CPMapTemplate?

    // CarPlay connected — install the root map template
    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didConnect controller: CPInterfaceController,
                                  to window: CPWindow) {
        self.interfaceController = controller

        let map = CPMapTemplate()
        map.mapDelegate = self
        // Safety-first: a prominent bar for P0 alerts coming from the agent graph
        map.automaticallyHidesNavigationBar = false
        map.leadingNavigationBarButtons = [destinationButton()]
        map.trailingNavigationBarButtons = [hudToggleButton()]
        self.mapTemplate = map
        controller.setRootTemplate(map, animated: true, completion: nil)

        // window.rootViewController = your MKMapView host (PracticeMapViewController())
    }

    func templateApplicationScene(_ scene: CPTemplateApplicationScene,
                                  didDisconnectInterfaceController controller: CPInterfaceController) {
        self.interfaceController = nil
    }

    private func destinationButton() -> CPBarButton {
        CPBarButton(title: "Destination") { [weak self] _ in
            // present a CPListTemplate of favourites (mirrors os.html favs)
            self?.presentFavourites()
        }
    }
    private func hudToggleButton() -> CPBarButton {
        CPBarButton(title: "HUD") { _ in /* toggle risk-field overlay */ }
    }

    private func presentFavourites() {
        let items = ["Domicile", "Travail", "Betterstate"].map { name in
            CPListItem(text: name, detailText: "Favori")
        }
        let section = CPListSection(items: items)
        let list = CPListTemplate(title: "Favoris", sections: [section])
        list.delegate = self
        interfaceController?.pushTemplate(list, animated: true, completion: nil)
    }

    // Called from the agent graph (risk node) when a P0 is detected → CarPlay alert
    func presentSafetyAlert(_ message: String) {
        let alert = CPNavigationAlert(
            titleVariants: [message], subtitleVariants: nil,
            image: nil, primaryAction: CPAlertAction(title: "OK", style: .default, handler: { _ in }),
            secondaryAction: nil, duration: 0)
        mapTemplate?.present(navigationAlert: alert, animated: true)
    }
}

extension CarPlaySceneDelegate: CPMapTemplateDelegate {
    func mapTemplate(_ mapTemplate: CPMapTemplate, startedTrip trip: CPTrip,
                     using routeChoice: CPRouteChoice) {
        // begin a CPNavigationSession and feed maneuvers from OSRM/agent-os
    }
}

extension CarPlaySceneDelegate: CPListTemplateDelegate {
    func listTemplate(_ listTemplate: CPListTemplate, didSelect item: CPListItem,
                      completionHandler: @escaping () -> Void) {
        // start routing to the chosen favourite, then push the map/trip
        completionHandler()
    }
}
