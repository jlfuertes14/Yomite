import { VideoScrollHero } from "@/components/ui/video-scroll-hero";
import { motion } from "framer-motion";

export default function VideoScrollHeroPage() {
  return (
    <div className="min-h-screen">
      <VideoScrollHero />

      {/* Next Section */}
      <motion.section
        className="relative bg-muted -mt-8 rounded-t-3xl min-h-screen"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{
          duration: 0.8,
          type: "spring",
          stiffness: 200,
          damping: 25,
        }}
      >
        <div className="container mx-auto px-8 py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.h2
              className="text-3xl md:text-5xl font-bold mb-8 text-foreground"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.2,
                duration: 0.8,
                type: "spring",
                stiffness: 200,
                damping: 25,
              }}
            >
              Next Section
            </motion.h2>
            <motion.p
              className="text-lg md:text-xl text-muted-foreground mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: 0.4,
                duration: 0.8,
                type: "spring",
                stiffness: 200,
                damping: 25,
              }}
            >
              The video has reached full size and now you can continue scrolling through the rest of the content.
            </motion.p>

            {/* Demo Content Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[1, 2, 3].map((item, index) => (
                <motion.div
                  key={item}
                  className="bg-card p-6 rounded-xl border border-border/50 shadow-sm"
                  initial={{ opacity: 0, y: 30, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{
                    delay: 0.6 + index * 0.1,
                    duration: 0.8,
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                  }}
                  whileHover={{
                    scale: 1.05,
                    y: -5,
                    transition: { type: "spring", stiffness: 400, damping: 25 }
                  }}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <div className="w-6 h-6 bg-primary rounded" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-foreground">
                    Feature {item}
                  </h3>
                  <p className="text-muted-foreground">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Sed do eiusmod tempor incididunt ut labore.
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
