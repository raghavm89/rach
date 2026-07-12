import type { Metadata } from "next";
import { getAllPosts } from "@/lib/mdx";
import { SectionWrapper } from '@rach/ui/components/ui/SectionWrapper';
import { SectionHeader } from '@rach/ui/components/ui/SectionHeader';
import { BlogPostCard } from '@rach/ui/components/ui/BlogPostCard';
import { AnimateIn } from '@rach/ui/components/ui/AnimateIn';
import { CTABanner } from '@rach/ui/components/sections/CTABanner';

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Stories, guides, and updates from the Rach Dev LLP team. Learn about backend infrastructure, AI agents, and building production-ready platforms.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <SectionWrapper>
        <SectionHeader
          eyebrow="BLOG"
          title="Stories from the team"
          subtitle="Guides, updates, and lessons from building a backend and AI agent platform."
        />
      </SectionWrapper>

      <SectionWrapper>
        {posts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <AnimateIn key={post.slug} delay={i * 0.05}>
                <BlogPostCard
                  title={post.title}
                  slug={post.slug}
                  excerpt={post.description}
                  date={post.date}
                  author={post.author}
                  tags={post.tags}
                />
              </AnimateIn>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-lg text-ink-3">
              No posts yet. Check back soon.
            </p>
          </div>
        )}
      </SectionWrapper>

      <CTABanner />
    </>
  );
}
