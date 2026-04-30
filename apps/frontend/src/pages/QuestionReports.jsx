import { useState } from "react";
import api from "@/lib/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, MessageSquare, Clock, CheckCircle, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { tr } from "date-fns/locale";

const statusConfig = {
  OPEN:      { label: "Beklemede",           color: "bg-amber-100 text-amber-700" },
  ANSWERED:  { label: "Yanıtlandı",          color: "bg-emerald-100 text-emerald-700" },
  ESCALATED: { label: "Yöneticiye İletildi", color: "bg-violet-100 text-violet-700" },
};

export default function QuestionReports() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [response, setResponse] = useState("");
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["educatorObjections"],
    queryFn: async () => {
      const { data } = await api.get("/educators/me/objections");
      return Array.isArray(data) ? data : [];
    },
    enabled: !!user,
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answerText }) =>
      api.post(`/educators/me/objections/${id}/answer`, { answerText }),
    onSuccess: () => {
      toast.success("Yanıt gönderildi");
      queryClient.invalidateQueries({ queryKey: ["educatorObjections"] });
      setSelectedReport(null);
      setResponse("");
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Yanıt gönderilemedi");
    },
  });

  const handleAnswer = () => {
    if (!response.trim() || response.trim().length < 5) {
      toast.error("En az 5 karakter yazın");
      return;
    }
    answerMutation.mutate({ id: selectedReport.id, answerText: response.trim() });
  };

  const pending  = reports.filter(r => r.status === "OPEN");
  const resolved = reports.filter(r => r.status !== "OPEN");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Hata Bildirimleri</h1>
        <p className="text-slate-500 mt-2">Adaylardan gelen soru itirazlarını yönet</p>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList>
          <TabsTrigger value="pending">Bekleyen ({pending.length})</TabsTrigger>
          <TabsTrigger value="resolved">Sonuçlanan ({resolved.length})</TabsTrigger>
        </TabsList>

        {/* ── Bekleyen ── */}
        <TabsContent value="pending">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-500">Bekleyen bildirim yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pending.map(report => {
                const daysLeft = report.deadlineAt
                  ? differenceInDays(new Date(report.deadlineAt), new Date())
                  : 10;
                const urgent = daysLeft <= 2;
                return (
                  <Card key={report.id} className={urgent ? "border-rose-200" : ""}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`p-3 rounded-xl shrink-0 ${urgent ? "bg-rose-100" : "bg-amber-100"}`}>
                            <AlertTriangle className={`w-5 h-5 ${urgent ? "text-rose-600" : "text-amber-600"}`} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={statusConfig[report.status]?.color ?? "bg-slate-100 text-slate-700"}>
                                {statusConfig[report.status]?.label ?? report.status}
                              </Badge>
                              <span className="text-sm font-medium text-slate-800 truncate">
                                {report.testTitle}
                              </span>
                            </div>
                            {report.questionContent && (
                              <p className="text-sm text-slate-500 italic line-clamp-2 mb-1">
                                "{report.questionContent}"
                              </p>
                            )}
                            <p className="text-sm text-slate-700">{report.reason}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                              <span>Bildiren: {report.reporterName}</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                {daysLeft > 0 ? `${daysLeft} gün kaldı` : "Süre doldu"}
                              </span>
                              <span>{format(new Date(report.createdAt), "d MMM yyyy", { locale: tr })}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => { setSelectedReport(report); setResponse(""); }}
                          className="shrink-0"
                        >
                          <MessageSquare className="w-4 h-4 mr-1.5" />
                          Yanıtla
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Sonuçlanan ── */}
        <TabsContent value="resolved">
          {resolved.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-slate-500">Sonuçlanan bildirim yok</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {resolved.map(report => (
                <Card key={report.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-xl bg-slate-100 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className={statusConfig[report.status]?.color ?? "bg-slate-100 text-slate-700"}>
                            {statusConfig[report.status]?.label ?? report.status}
                          </Badge>
                          <span className="text-sm font-medium text-slate-800">{report.testTitle}</span>
                        </div>
                        {report.questionContent && (
                          <p className="text-sm text-slate-500 italic line-clamp-1">
                            "{report.questionContent}"
                          </p>
                        )}
                        <p className="text-sm text-slate-700 mt-1">{report.reason}</p>
                        {report.answerText && (
                          <div className="mt-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                            <p className="text-xs font-semibold text-emerald-700 mb-1">Yanıtınız:</p>
                            <p className="text-sm text-slate-700">{report.answerText}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                          <span>Bildiren: {report.reporterName}</span>
                          {report.answeredAt && (
                            <span>
                              Yanıtlandı: {format(new Date(report.answeredAt), "d MMM yyyy", { locale: tr })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Yanıt Dialog ── */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bildirime Yanıt Ver</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 mt-2">
              <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Test</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedReport.testTitle}</p>
                </div>
                {selectedReport.questionContent && (
                  <div>
                    <p className="text-xs text-slate-400 font-medium">Soru (ilk 150 karakter)</p>
                    <p className="text-sm text-slate-600 italic">"{selectedReport.questionContent}"</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-400 font-medium">Aday Bildirimi</p>
                  <p className="text-sm text-slate-700">{selectedReport.reason}</p>
                </div>
              </div>
              <Textarea
                value={response}
                onChange={e => setResponse(e.target.value)}
                placeholder="Yanıtınızı yazın (en az 5 karakter)..."
                rows={4}
              />
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setSelectedReport(null)}>İptal</Button>
                <Button
                  onClick={handleAnswer}
                  disabled={answerMutation.isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {answerMutation.isPending ? "Gönderiliyor..." : "Yanıtla"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
