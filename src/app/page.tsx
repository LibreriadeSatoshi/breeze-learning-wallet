import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to welcome page by default
  redirect('/welcome');
}
