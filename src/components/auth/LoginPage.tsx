import { LandingPage } from '../LandingPage';

export function LoginPage() {
  // The LandingPage component handles everything now
  return <LandingPage onEnterApp={() => {/* User will be redirected after auth */}} />;
}
