export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <p>Admin area</p>
      {children}
    </div>
  );
}
