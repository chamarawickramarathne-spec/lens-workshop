import { Link } from "react-router-dom";
import { GraduationCap, Calendar, Users, Wallet, ArrowRight, Sparkles, Link2, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: Calendar, title: "Workshop Dashboard", desc: "Create and view all your workshops at a glance." },
  { icon: Link2, title: "Shareable Join Links", desc: "Send a link — students sign up themselves." },
  { icon: FileImage, title: "Payment Slip Upload", desc: "Students upload slip images. You verify in one click." },
  { icon: Wallet, title: "PDF Reports", desc: "Download a payment summary for any workshop." },
];

const Landing = () => {
  return (
    <div className="min-h-screen">
      <header className="container flex items-center justify-between h-20">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gold-gradient grid place-items-center shadow-gold">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold">
            Workshop <span className="text-gold">Manager</span>
          </span>
        </Link>
        <Link to="/auth">
          <Button variant="ghost">Sign in</Button>
        </Link>
      </header>

      <section className="container py-20 md:py-32 text-center relative">
        <div className="absolute inset-0 -z-10 opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-gold-gradient blur-[140px]" />
        </div>

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full hairline bg-secondary/50 text-sm text-muted-foreground mb-8 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
          For instructors who run paid workshops
        </div>

        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.05] tracking-tight max-w-5xl mx-auto animate-fade-in">
          Run your workshops.{" "}
          <span className="text-gold-gradient">Track every payment.</span>
        </h1>

        <p className="mt-8 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
          Workshop Manager makes it effortless to register students, collect payment slips,
          and keep your workshop finances organized — all in one elegant dashboard.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
          <Link to="/auth">
            <Button variant="hero" size="xl">
              Start free <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="xl">Sign in</Button>
          </Link>
        </div>
      </section>

      <section className="container py-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="surface-gradient rounded-2xl p-6 hairline shadow-card hover:shadow-gold transition-all hover:-translate-y-1 animate-fade-in"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="w-11 h-11 rounded-lg bg-secondary grid place-items-center mb-4">
                <f.icon className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-display text-xl font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <span className="font-display">Workshop Manager</span> · Run workshops with ease
      </footer>
    </div>
  );
};

export default Landing;
