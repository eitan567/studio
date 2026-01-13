import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="h-screen flex flex-col bg-background">
            {/* Header Skeleton */}
            <div className="border-b p-4 flex items-center justify-between bg-card">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-8 w-48" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar Skeleton */}
                <div className="w-80 border-r bg-card p-4 hidden lg:block">
                    <Skeleton className="h-10 w-full mb-6" />
                    <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-square w-full rounded-md" />
                        ))}
                    </div>
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 bg-muted/30 p-8 flex items-center justify-center">
                    <div className="flex gap-4">
                        <Skeleton className="h-[600px] w-[450px] rounded-lg shadow-sm" />
                        <Skeleton className="h-[600px] w-[450px] rounded-lg shadow-sm" />
                    </div>
                </div>

                {/* Right Sidebar Skeleton */}
                <div className="w-80 border-l bg-card p-4 hidden xl:block">
                    <Skeleton className="h-8 w-full mb-4" />
                    <Skeleton className="h-32 w-full mb-4" />
                    <Skeleton className="h-32 w-full" />
                </div>
            </div>
        </div>
    )
}
