"use client";

import { Activity, Group, Monitor, Settings, ShieldAlert, Users } from "lucide-react";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function AdminDashboard() {
  const { user } = useUser();
  const userId = user?.id || "guest";
  // Convex Hook for global lanes (For MVP, we show all lanes)
  const allLanes = useQuery(api.trade_lanes.getLanes, { userId });

  return (
    <div className="space-y-8 p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Admin Console</h1>
          <p className="text-muted-foreground text-sm">
            Platform-wide overview and compliance monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Global Settings
          </Button>
          <Button>
            <Monitor className="mr-2 h-4 w-4" />
            Audit Logs
          </Button>
        </div>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Users</CardTitle>
            <Users className="text-primary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,248</div>
            <p className="text-muted-foreground text-xs">+12% from last quarter</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
            <Group className="text-primary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">142</div>
            <p className="text-muted-foreground text-xs">+5 new this week</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Savings</CardTitle>
            <Activity className="text-primary h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£24.8M</div>
            <p className="text-muted-foreground text-xs">Aggregated duty relief</p>
          </CardContent>
        </Card>
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Alerts</CardTitle>
            <ShieldAlert className="text-destructive h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-muted-foreground text-xs">Requires attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Monitoring Table */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Global Compliance Feed</CardTitle>
          <CardDescription>Live monitoring from Convex trade lanes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Verified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allLanes?.map((lane) => (
                <TableRow key={lane._id}>
                  <TableCell className="font-medium">Elite Demo Org</TableCell>
                  <TableCell>{lane.originCountry}</TableCell>
                  <TableCell className="font-mono text-xs">{lane.commodityCode}</TableCell>
                  <TableCell>{lane.tier}</TableCell>
                  <TableCell>
                    <Badge variant={lane.status === "Verified" ? "default" : "destructive"}>
                      {lane.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right text-xs">
                    {new Date(lane.lastVerified).toLocaleTimeString()}
                  </TableCell>
                </TableRow>
              ))}
              {(!allLanes || allLanes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-4 text-center">
                    No active compliance data.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
