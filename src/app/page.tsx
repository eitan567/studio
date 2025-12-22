import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BookImage,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { placeholderImages } from '@/lib/placeholder-images.json';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

const features = [
  {
    icon: <UploadCloud className="h-10 w-10 text-primary" />,
    title: 'Seamless Photo Upload',
    description:
      'Easily upload photos from your device or connect to Google Photos to import your favorite memories in seconds.',
  },
  {
    icon: <Sparkles className="h-10 w-10 text-primary" />,
    title: 'AI-Powered Enhancements',
    description:
      'Our smart AI analyzes your photos, suggests optimal layouts, and provides style recommendations to make your album stunning.',
  },
  {
    icon: <BookImage className="h-10 w-10 text-primary" />,
    title: 'Realistic Print Preview',
    description:
      "Flip through a beautiful, interactive preview of your photobook to see exactly how it will look when printed.",
  },
];

export default function LandingPage() {
  const heroImage = placeholderImages.find((img) => img.id === 'hero');

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-card">
          <div className="container px-4 md:px-6">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-4">
                <div className="space-y-2">
                  <h1 className="font-headline text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Craft Your Memories into Beautiful Photobooks
                  </h1>
                  <p className="max-w-[600px] text-muted-foreground md:text-xl">
                    With PhotoBooker, transform your digital photos into
                    stunning, high-quality printed albums. Effortlessly design,
                    customize, and preview your unique story.
                  </p>
                </div>
                <div className="flex flex-col gap-2 min-[400px]:flex-row">
                  <Button asChild size="lg" className="font-bold">
                    <Link href="/signup">
                      Get Started Free <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link href="/login">Sign In</Link>
                  </Button>
                </div>
              </div>
              {heroImage && (
                <Image
                  src={heroImage.imageUrl}
                  alt={heroImage.description}
                  width={600}
                  height={400}
                  className="mx-auto aspect-video overflow-hidden rounded-xl object-cover sm:w-full lg:order-last lg:aspect-square"
                  data-ai-hint={heroImage.imageHint}
                />
              )}
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className="space-y-2">
                <div className="inline-block rounded-lg bg-muted px-3 py-1 text-sm">
                  Key Features
                </div>
                <h2 className="font-headline text-3xl font-bold tracking-tighter sm:text-5xl">
                  Everything You Need to Create Perfection
                </h2>
                <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                  From intelligent design tools to realistic previews, we've
                  built a platform that makes creating professional photo
                  albums intuitive and enjoyable.
                </p>
              </div>
            </div>
            <div className="mx-auto grid max-w-5xl items-start gap-8 sm:grid-cols-2 md:gap-12 lg:grid-cols-3 mt-12">
              {features.map((feature, index) => (
                <Card
                  key={index}
                  className="transform transition-transform duration-300 hover:scale-105 hover:shadow-xl"
                >
                  <CardHeader className="items-center">
                    {feature.icon}
                    <CardTitle className="font-headline text-2xl pt-4">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-center">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-card">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="font-headline text-3xl font-bold tracking-tighter md:text-4xl/tight">
                Ready to Tell Your Story?
              </h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Start creating your personalized photo album today. It’s free to
                get started.
              </p>
            </div>
            <div className="mx-auto w-full max-w-sm space-y-2">
              <Button asChild size="lg" className="w-full font-bold">
                <Link href="/signup">
                  Create Your Photobook{' '}
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
