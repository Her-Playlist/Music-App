# Music App

A modern, cross-platform music streaming and management application built with React Native and Expo. Browse, discover, and manage your music library with an intuitive interface.

## Features

- **Music Discovery**: Browse and search for songs, artists, and albums
- **Playlists**: Create and manage personalized playlists
- **Player Controls**: Full playback controls with play, pause, skip, and volume management
- **Navigation**: Dedicated screens for exploring playlists, artists, albums, and personal music library
- **Cross-Platform**: Run on iOS, Android, and web with a single codebase
- **Modern UI**: Clean, responsive interface designed for mobile-first experience

## Tech Stack

- **Framework**: [React Native](https://reactnative.dev) with [Expo](https://expo.dev)
- **Language**: TypeScript
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Build Tool**: Expo with new architecture enabled

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Expo CLI (install globally with `npm install -g expo-cli`)

### Installation

1. Clone the repository and navigate to the project directory:

   ```bash
   cd music-app
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npx expo start
   ```

### Running the App

From the Expo CLI output, choose one of the following options:

- **iOS Simulator**: Press `i` (requires macOS with Xcode)
- **Android Emulator**: Press `a` (requires Android Studio)
- **Expo Go**: Scan the QR code with the [Expo Go](https://expo.dev/go) app on your phone
- **Web**: Press `w` (runs in your default browser)

## Project Structure

```
app/
├── (tabs)/              # Tab-based navigation (Home, Search, Library, Profile)
├── albums/              # Album detail screens
├── artists/             # Artist detail screens
├── player/              # Player UI and controls
├── playlist/            # Playlist detail screens
├── _layout.tsx          # Root layout
├── modal.tsx            # Modal screens
└── +not-found.tsx       # 404 page
```

## Development

The app uses file-based routing. To add new screens, create files in the `app/` directory. The file structure automatically becomes your app's navigation structure.

## Learn More

- [Expo Documentation](https://docs.expo.dev/): Complete guides and API reference
- [React Native Docs](https://reactnative.dev/docs/getting-started): React Native fundamentals
- [Expo Router Guide](https://docs.expo.dev/router/introduction/): File-based routing documentation
