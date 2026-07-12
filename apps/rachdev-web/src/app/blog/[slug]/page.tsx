import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { getPostBySlug, getAllPosts } from "@/lib/mdx";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { Breadcrumb } from '@rach/ui/components/ui/Breadcrumb';
import { Badge } from '@rach/ui/components/ui/Badge';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

interface BlogPostPageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
  };
}

export default function BlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      {/* Breadcrumb */}
      <SectionWrapper className="pb-0 pt-8 lg:pb-0 lg:pt-8">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
            { label: post.title },
          ]}
        />
      </SectionWrapper>

      {/* Article */}
      <SectionWrapper>
        <article className="mx-auto max-w-3xl">
          <AnimateIn>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink md:text-4xl lg:text-5xl">
              {post.title}
            </h1>

            {/* Meta */}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-ink-3">
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span>&middot;</span>
              <span>{post.author}</span>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </AnimateIn>

          {/* Content */}
          <AnimateIn delay={0.1}>
            <div className="prose prose-lg mt-10 max-w-none prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-ink prose-p:text-ink-2 prose-p:leading-relaxed prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-ink prose-ul:text-ink-2 prose-ol:text-ink-2 prose-li:marker:text-accent">
              <MDXRemote source={post.content} />
            </div>
          </AnimateIn>
        </article>
      </SectionWrapper>

      <CTABanner />
    </>
  );
}
