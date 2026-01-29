// Global React & React Native type declarations
import 'react';
import 'react-native';

declare module 'react' {
  // Add useState and useEffect type declarations here
  export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useContext<T>(context: React.Context<T>): T;
}

// Other global type declarations
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Add any custom JSX elements if needed
    }
  }
} 