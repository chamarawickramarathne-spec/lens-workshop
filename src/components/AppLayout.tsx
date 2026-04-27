import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, LayoutDashboard, CalendarPlus, BarChart3, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const AppLayout = ({ children }: { children: ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate("/auth");
  };

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/reports", label: "Reports", icon: BarChart3 },
    { to: "/events/new", label: "New Workshop", icon: CalendarPlus },
    { to: "/profile", label: "Profile", icon: User },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-lg bg-gold-gradient grid place-items-center shadow-gold">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display text-xl font-semibold tracking-tight">
              Workshop <span className="text-gold">Manager</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link 
              to="/profile" 
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors text-sm text-muted-foreground hover:text-foreground group"
            >
              <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary border border-border/50 group-hover:border-gold/30 transition-colors">
                {user?.profile?.avatar_url ? (
                  <img 
                    src={user.profile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full grid place-items-center">
                    <User className="w-4 h-4 text-gold/60" />
                  </div>
                )}
              </div>
              <span className="font-medium">
                {user?.profile?.display_name || user?.email.split('@')[0]}
              </span>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8 animate-fade-in">{children}</main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <span className="font-display">Workshop Manager</span> · Run workshops with ease
      </footer>
    </div>
  );
};
