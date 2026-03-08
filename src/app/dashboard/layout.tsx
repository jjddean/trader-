import { UserSync } from "@/components/auth/user-sync";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <UserSync />
            {children}
        </>
    );
}
