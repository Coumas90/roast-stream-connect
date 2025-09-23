import { Helmet } from "react-helmet-async";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import ValueProposition from "@/components/landing/ValueProposition";
import CoffeeOrigins from "@/components/landing/CoffeeOrigins";
import BusinessSegments from "@/components/landing/BusinessSegments";
import Products from "@/components/landing/Products";
import Technology from "@/components/landing/Technology";
import Testimonials from "@/components/landing/Testimonials";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Helmet>
        <title>TUPÁ Hub – El café que transforma tu negocio</title>
        <meta name="description" content="Plataforma integral de café con IA: gestión de stock, reposición automática, café de origen trazable y Academy para baristas. Prueba gratis." />
        <meta name="keywords" content="café, gestión stock, reposición automática, café colombiano, tecnología café, Academy baristas, TUPÁ" />
        <link rel="canonical" href={typeof window !== 'undefined' ? window.location.href : '/'} />
        <meta property="og:title" content="TUPÁ Hub – El café que transforma tu negocio" />
        <meta property="og:description" content="Conectamos tostadores y cafeterías con tecnología inteligente. Desde el origen hasta la taza perfecta." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      
      <Header />
      <Hero />
      <ValueProposition />
      <CoffeeOrigins />
      <BusinessSegments />
      <Products />
      <Technology />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
};

export default Index;
