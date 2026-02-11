"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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
      <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="section-title">History</h1>
          <p className="section-copy mt-2">Mock список задач с фильтром по статусу и поиском.</p>
        </div>

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
          <Card key={item.id} className="transition hover:shadow-glow">
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
