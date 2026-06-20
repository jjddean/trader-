import { UserSync } from "@/components/auth/user-sync";

export default function SessionTasksLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UserSync />
      {children}
    </>
  );
}
