import { Redirect } from 'expo-router';

/{ /* 404/Redirect catch-all for legacy /messaging route */ }
export default function MessagingRedirect() {
  return <Redirect href="/messages" />;
}
