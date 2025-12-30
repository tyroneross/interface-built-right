import { redirect } from 'next/navigation';

// Redirect to the main dashboard
export default function HomePage() {
  redirect('/dashboard');
}
