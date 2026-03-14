"use client";

import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { Globe, ShieldCheck, TrendingUp, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SectionCards() {
  const { user } = useUser();
  const userId = user?.id || "guest";
  // Fetch live trade lane data for stats
  const lanes = useQuery(api.trade_lanes.getLanes, { userId });

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {/* Active Trade Lanes */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active Trade Lanes</CardDescription>
          <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl">
            {lanes?.length || 0}
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5">
              <Globe className="size-3.5" />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Real-time stats from Convex <Globe className="text-primary size-4" />
          </div>
        </CardFooter>
      </Card>

      {/* Compliance Rate */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Compliance Rate</CardDescription>
          <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl">
            98.5%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5">
              <ShieldCheck className="size-3.5" />
              Verified
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            High confidence verification <ShieldCheck className="text-primary size-4" />
          </div>
        </CardFooter>
      </Card>

      {/* Total Duty Savings */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Duty Savings</CardDescription>
          <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl">
            £458,200
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5">
              <TrendingUp className="size-3.5" />
              +£12.3k/mo
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Estimated annual savings <TrendingUp className="text-primary size-4" />
          </div>
        </CardFooter>
      </Card>

      {/* Simulations Run */}
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Simulations Run</CardDescription>
          <CardTitle className="text-xl font-bold tabular-nums @[250px]/card:text-2xl">
            142
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="gap-1.5">
              <Zap className="size-3.5" />
              Updated
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Across 15 countries <Zap className="text-primary size-4" />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
