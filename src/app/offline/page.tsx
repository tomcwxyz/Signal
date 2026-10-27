import Link from "next/link";
export default function OfflinePage() {
  return <main className="offline-fallback">
    <div className="brand-mark" aria-hidden="true">⌁</div>
    <h1>You're offline. Signal still has your saved places.</h1>
    <p>Open Signal to see areas you've saved on this device. Street map tiles and new Wi-Fi look-ups need a connection.</p>
    <Link className="primary-button" href="/">Open Signal</Link>
  </main>;
}
