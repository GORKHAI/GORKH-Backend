import SwiftUI

enum NearMindTheme {
    static let primaryDarkGreen = Color(red: 0.024, green: 0.251, blue: 0.169)
    static let background = Color(red: 0.012, green: 0.044, blue: 0.034)
    static let surface = Color(red: 0.033, green: 0.133, blue: 0.094)
    static let elevatedSurface = Color(red: 0.049, green: 0.176, blue: 0.125)
    static let accentMint = Color(red: 0.569, green: 0.902, blue: 0.749)
    static let textPrimary = Color(red: 0.965, green: 0.949, blue: 0.898)
    static let textSecondary = Color(red: 0.667, green: 0.741, blue: 0.686)
    static let warning = Color(red: 0.851, green: 0.651, blue: 0.322)
    static let error = Color(red: 0.824, green: 0.361, blue: 0.361)
    static let success = Color(red: 0.451, green: 0.816, blue: 0.604)
    static let border = Color.white.opacity(0.10)
}

struct NearMindLogoMark: View {
    var size: CGFloat = 72

    var body: some View {
        Image("NearMindLogo")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .accessibilityLabel("NearMind logo")
    }
}
