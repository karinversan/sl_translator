"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Home, Radio, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { mockHistory } from "@/lib/mock/jobs";

export default function HistoryPage() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = useMemo(() => {
    return mockHistory.filter((item) => {
      const matchStatus = statusFilter === "All" || item.status === statusFilter;
      const q = query.toLowerCase();
      const matchQuery =
        item.id.toLowerCase().includes(q) ||
        item.language.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  }, [query, statusFilter]);

  return (
    <section className="container pb-14 pt-12">
      <div className="page-head flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="page-kicker">Jobs history</p>
          <h1 className="section-title">History</h1>
          <p className="page-lead">Mock job list with status filters, search, and quick open actions.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Home
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/live">
              <Radio className="h-4 w-4" />
              Realtime
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/upload">
              <Upload className="h-4 w-4" />
              Video
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-8 flex w-full flex-wrap gap-2 md:w-auto">
        <div className="flex w-full gap-2 md:w-auto">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search id/language/type"
            className="md:w-64"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              <SelectItem value="Processing">Processing</SelectItem>
              <SelectItem value="Done">Done</SelectItem>
              <SelectItem value="Failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <Card key={item.id} className="border-white/10 bg-black/45 transition hover:border-white/20">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <CardTitle className="text-lg">{item.id}</CardTitle>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{item.createdAt}</span>
                  <span>•</span>
                  <span>{item.type}</span>
                  <span>•</span>
                  <span>{item.language}</span>
                  <Badge
                    variant={
                      item.status === "Done"
                        ? "success"
                        : item.status === "Processing"
                          ? "default"
                          : "danger"
                    }
                  >
                    {item.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/jobs/${item.id}`}>Open</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
