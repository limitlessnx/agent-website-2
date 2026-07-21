"use client";

import { Filter, MessageCircle, Search, Send, Star, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { Lead } from "@/lib/limitless-data";

type LeadsCrmProps = {
  leads: Lead[];
};

const statuses = ["all", "new", "in_conversation", "qualified", "cold"] as const;
const scores = ["all", "hot", "warm", "cold", "unscored"] as const;

function normalize(value: string | undefined) {
  return String(value || "").trim().toLowerCase();
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function getLeadInitial(name: string) {
  return String(name || "?").slice(0, 1).toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusLabel(value?: string) {
  return String(value || "new").replace(/_/g, " ");
}

export default function LeadsCrm({ leads }: LeadsCrmProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [score, setScore] = useState<(typeof scores)[number]>("all");

  const filteredLeads = useMemo(() => {
    const normalizedQuery = normalize(query);

    return leads.filter((lead) => {
      const haystack = [
        lead.name,
        lead.phone,
        lead.status,
        lead.score,
        lead.budget,
        lead.location_preference,
        lead.property_type,
        lead.purpose,
      ]
        .map((value) => normalize(value))
        .join(" ");

      const statusMatches = status === "all" || normalize(lead.status) === status;
      const scoreMatches = score === "all" || normalize(lead.score || "unscored") === score;
      const queryMatches = !normalizedQuery || haystack.includes(normalizedQuery);

      return statusMatches && scoreMatches && queryMatches;
    });
  }, [leads, query, score, status]);

  const hotLeads = leads.filter((lead) => normalize(lead.score) === "hot" || normalize(lead.status) === "qualified").length;
  const warmLeads = leads.filter((lead) => normalize(lead.score) === "warm").length;
  const followUpLeads = leads.filter((lead) => Number(lead.follow_up_stage || 0) > 0).length;
  const qualifiedRate = leads.length ? Math.round((hotLeads / leads.length) * 100) : 0;

  return (
    <div className="leads-crm">
      <div className="leads-crm-summary">
        <div>
          <span><UserCheck size={16} /></span>
          <p>Total Leads</p>
          <strong>{leads.length}</strong>
        </div>
        <div>
          <span><Star size={16} /></span>
          <p>Hot / Qualified</p>
          <strong>{hotLeads}</strong>
        </div>
        <div>
          <span><MessageCircle size={16} /></span>
          <p>Warm Leads</p>
          <strong>{warmLeads}</strong>
        </div>
        <div>
          <span><Send size={16} /></span>
          <p>In Follow-up</p>
          <strong>{followUpLeads}</strong>
        </div>
      </div>

      <section className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Lead Control</h2>
            <p>{filteredLeads.length} of {leads.length} lead records showing. Qualification rate: {qualifiedRate}%.</p>
          </div>
        </div>

        <div className="lead-filter-bar">
          <label className="lead-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, budget, location..."
            />
          </label>
          <label>
            <Filter size={15} />
            <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
              {statuses.map((item) => (
                <option key={item} value={item}>{item.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label>
            <Star size={15} />
            <select value={score} onChange={(event) => setScore(event.target.value as typeof score)}>
              {scores.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="leads-card-grid">
          {filteredLeads.map((lead) => (
            <article key={lead.id} className="lead-card">
              <div className="lead-card-top">
                <span className="admin-avatar">{getLeadInitial(lead.name)}</span>
                <div>
                  <strong>{lead.name || "Unknown lead"}</strong>
                  <p>{lead.phone || "No phone saved"}</p>
                </div>
                <em className={`lead-score score-${normalize(lead.score || "unscored")}`}>
                  {lead.score || "unscored"}
                </em>
              </div>

              <div className="lead-card-meta">
                <span>{getStatusLabel(lead.status)}</span>
                <span>{lead.budget || "Budget pending"}</span>
                <span>{lead.location_preference || "Location pending"}</span>
                <span>{lead.property_type || "Property type pending"}</span>
              </div>

              <div className="lead-card-bottom">
                <span>Follow-up stage {lead.follow_up_stage ?? 0}</span>
                <span>{formatDate(lead.last_contacted_at || lead.created_at)}</span>
              </div>

              <div className="lead-card-actions">
                <a href={whatsappHref(lead.phone)} target="_blank" rel="noreferrer">
                  <MessageCircle size={15} />
                  WhatsApp
                </a>
                <a href={`/dashboard/limitless/campaigns?lead=${encodeURIComponent(lead.phone || lead.id)}`}>
                  <Send size={15} />
                  Campaign
                </a>
              </div>
            </article>
          ))}
        </div>

        {!filteredLeads.length ? (
          <div className="admin-empty-state">
            <strong>No leads match this view.</strong>
            <p>Try clearing the search or changing the status/score filter.</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
