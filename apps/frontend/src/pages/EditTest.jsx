import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { entities, topics as topicsApi } from "@/api/dalClient";
import api from "@/lib/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Plus, GripVertical, BookOpen,
  Lightbulb, CheckCircle2, Eye, History,
} from "lucide-react";
import { useServiceStatus } from "@/lib/useServiceStatus";
import { useAutoSave } from "@/lib/useAutoSave";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
// Paylaşılan soru formu ve önizleme modalı
import { QuestionForm } from "@/components/questions/QuestionForm";
import { TestPreviewModal } from "@/components/TestPreviewModal";

export default function EditTest() {
  const urlParams  = new URLSearchParams(window.location.search);
  const testId     = urlParams.get("id");
  const queryClient = useQueryClient();
  const { testPublishingEnabled } = useServiceStatus();

  const [formData,         setFormData]         = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [editingQuestion,  setEditingQuestion]  = useState(null);
  const [newQuestion,      setNewQuestion]      = useState(false);
  const [previewOpen,      setPreviewOpen]      = useState(false);
  const [currentPage,      setCurrentPage]      = useState(1);
  const questionsPerPage = 50;

  // ─── Auto-save ──────────────────────────────────────────────────────────
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftInfo,       setDraftInfo]       = useState(null);
  const getFormData = useCallback(() => formData, [formData]);
  const { hasDraft, loadDraft, clearDraft } = useAutoSave(
    testId ? `editTest_${testId}` : "__noop__",
    getFormData,
    { enabled: !!testId && !!formData },
  );

  // ─── Sorgular ───────────────────────────────────────────────────────────
  const { data: testDetail, isLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn:  async () => { const { data } = await api.get(`/tests/${testId}`); return data; },
    enabled:  !!testId,
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ["examTypes"],
    queryFn:  () => entities.ExamType.filter({ is_active: true }),
  });

  // Soru bazında konu seçimi için düz liste
  // /admin/topics endpoint'i ADMIN gerektirir; eğiticiler için boş döner — graceful fallback
  const { data: topicList = [] } = useQuery({
    queryKey: ["topicsFlat", formData?.exam_type_id],
    queryFn:  async () => {
      try {
        return await topicsApi.flat(formData?.exam_type_id || undefined);
      } catch {
        return [];
      }
    },
    enabled:   !!formData,
    retry:     false,
    staleTime: 60_000,
  });

  const questions = testDetail?.questions || [];

  useEffect(() => {
    if (testDetail && !formData) {
      const fd = {
        title:           testDetail.title,
        price:           testDetail.priceCents != null ? testDetail.priceCents / 100 : 0,
        duration_minutes: testDetail.duration ?? 60,
        is_timed:        !!testDetail.isTimed,
        has_solutions:   !!testDetail.hasSolutions,
        exam_type_id:    testDetail.examTypeId || "",
        is_published:    !!testDetail.publishedAt,
      };
      setFormData(fd);
      setOriginalFormData(fd);

      if (testId && hasDraft()) {
        const draft = loadDraft();
        if (draft?.data && draft.data.title !== fd.title) {
          setDraftInfo(draft);
          setShowDraftDialog(true);
        } else {
          clearDraft();
        }
      }
    }
  }, [testDetail]);

  // ─── Mutasyonlar ────────────────────────────────────────────────────────
  const updateTestMutation = useMutation({
    mutationFn: async (data) => {
      await api.patch(`/tests/${testId}`, {
        title:        data.title,
        priceCents:   data.price != null ? Math.round(data.price * 100) : undefined,
        duration:     data.duration_minutes,
        isTimed:      data.is_timed,
        hasSolutions: data.has_solutions,
      });
      if (data.is_published != null) {
        if (data.is_published) await api.put(`/tests/${testId}/publish`);
        else                   await api.put(`/tests/${testId}/unpublish`);
      }
    },
    onSuccess: () => {
      toast.success("Test güncellendi");
      clearDraft();
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setOriginalFormData(formData);
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? err?.message ?? "Güncelleme başarısız"),
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data) => {
      const options = (data.options || []).filter(o => (o.content || "").trim() || o.mediaUrl);
      await api.post(`/tests/${testId}/questions`, {
        content:          data.question_text,
        mediaUrl:         data.question_mediaUrl || undefined,
        order:            questions.length,
        topicId:          data.topicId || undefined,
        solutionText:     data.solutionText || undefined,
        solutionMediaUrl: data.solutionMediaUrl || undefined,
        options,
      });
    },
    onSuccess: () => {
      toast.success("Soru eklendi");
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setNewQuestion(false);
      setEditingQuestion(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Soru eklenemedi"),
  });

  const updateQuestionMutation = useMutation({
    mutationFn: async ({ questionId, data }) => {
      await api.patch(`/tests/${testId}/questions/${questionId}`, {
        content:          data.question_text,
        mediaUrl:         data.question_mediaUrl ?? undefined,
        order:            data.order,
        topicId:          data.topicId ?? undefined,
        solutionText:     data.solutionText || undefined,
        solutionMediaUrl: data.solutionMediaUrl || undefined,
      });
      for (let i = 0; i < (data.options || []).length; i++) {
        const opt  = data.options[i];
        const orig = editingQuestion?.options?.[i];
        if (orig?.id && (opt.content !== orig.content || opt.isCorrect !== orig.isCorrect || opt.mediaUrl !== orig.mediaUrl)) {
          await api.patch(`/tests/${testId}/questions/${questionId}/options/${orig.id}`, {
            content:  opt.content,
            isCorrect: opt.isCorrect,
            mediaUrl: opt.mediaUrl ?? undefined,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Soru güncellendi");
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setEditingQuestion(null);
    },
    onError: (err) => toast.error(err?.response?.data?.message ?? "Güncelleme başarısız"),
  });

  // ─── İşleyiciler ────────────────────────────────────────────────────────
  const handleSaveTest = () => updateTestMutation.mutate({ ...formData, is_published: null });

  const handleTogglePublish = () => {
    if (!testPublishingEnabled && !formData.is_published) {
      toast.warning("Test yayınlama geçici olarak durdurulmuştur.");
      return;
    }
    if (questions.length === 0 && !formData.is_published) {
      toast.error("Yayınlamak için en az 1 soru ekleyin");
      return;
    }
    if (formData.has_solutions && !formData.is_published) {
      const missing = questions.filter(q => !q.solutionText?.trim() && !q.solutionMediaUrl?.trim());
      if (missing.length > 0) {
        toast.error(`${missing.length} soru için çözüm eksik.`);
        return;
      }
    }
    const newVal = !formData.is_published;
    setFormData({ ...formData, is_published: newVal });
    updateTestMutation.mutate({ ...formData, is_published: newVal });
  };

  const handleSaveQuestion = (data) => {
    if (editingQuestion) {
      updateQuestionMutation.mutate({ questionId: editingQuestion.id, data });
    } else {
      createQuestionMutation.mutate(data);
    }
  };

  // ─── Yükleme / guard ────────────────────────────────────────────────────
  if (isLoading || !formData) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const hasChanges    = originalFormData && JSON.stringify(originalFormData) !== JSON.stringify(formData);
  const totalPages    = Math.ceil(questions.length / questionsPerPage);
  const startIndex    = (currentPage - 1) * questionsPerPage;
  const currentQuestions = questions.slice(startIndex, startIndex + questionsPerPage);

  const solutionStats = formData.has_solutions ? {
    total: questions.length,
    done:  questions.filter(q => q.solutionText?.trim() || q.solutionMediaUrl?.trim()).length,
  } : null;

  const draftSavedAt = draftInfo?.savedAt
    ? (() => { try { return format(new Date(draftInfo.savedAt), "d MMM yyyy HH:mm", { locale: tr }); } catch { return draftInfo.savedAt; } })()
    : null;

  return (
    <div className="max-w-6xl mx-auto">

      {/* ─── Taslak kurtarma diyaloğu ─── */}
      <Dialog open={showDraftDialog} onOpenChange={setShowDraftDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Kaydedilmemiş Değişiklikler
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Bu test için kaydedilmemiş değişiklikler bulundu.
              {draftSavedAt && <span className="text-slate-400"> ({draftSavedAt})</span>}
            </p>
            <p className="text-sm text-slate-500">Taslak başlığı: <strong>"{draftInfo?.data?.title}"</strong></p>
            <div className="flex gap-3">
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={() => {
                if (draftInfo?.data) setFormData(draftInfo.data);
                toast.success("Taslak yüklendi");
                setShowDraftDialog(false);
              }}>Devam Et</Button>
              <Button variant="outline" className="flex-1" onClick={() => { clearDraft(); setShowDraftDialog(false); }}>
                Yoksay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6">
        <Link to={createPageUrl("MyTestPackages")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Test Paketlerime Dön
        </Link>
        <div className="flex items-center gap-3">
          {questions.length > 0 && (
            <Button variant="outline" onClick={() => setPreviewOpen(true)}
              className="border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5">
              <Eye className="w-4 h-4" />Aday Önizlemesi
            </Button>
          )}
          <div className="flex items-center gap-2">
            <Switch
              checked={formData.is_published}
              onCheckedChange={handleTogglePublish}
              disabled={!testPublishingEnabled && !formData.is_published}
            />
            <span className="text-sm text-slate-600">
              {formData.is_published ? "Yayında" : "Taslak"}
            </span>
            {!testPublishingEnabled && !formData.is_published && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                Yayınlama bakımda
              </span>
            )}
          </div>
          <Button onClick={handleSaveTest}
            disabled={updateTestMutation.isPending || !hasChanges}
            className="bg-indigo-600 hover:bg-indigo-700">
            <Save className="w-4 h-4 mr-2" />Kaydet
          </Button>
        </div>
      </div>

      {/* ─── Test bilgileri ─── */}
      <Card className="mb-6">
        <CardHeader><CardTitle>Test Bilgileri</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Başlık</Label>
              <Input value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Sınav Türü</Label>
              <Select value={formData.exam_type_id || "none"}
                onValueChange={v => setFormData({ ...formData, exam_type_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Seçilmedi —</SelectItem>
                  {examTypes.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiyat (₺)</Label>
              <Input type="number" min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Süre (dakika)</Label>
              <Input type="number" min="1"
                value={formData.duration_minutes}
                onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formData.is_timed}
                onCheckedChange={v => setFormData({ ...formData, is_timed: v })} />
              <Label>Süreli test</Label>
            </div>
          </div>

          {/* Çözümlü toggle */}
          <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
            formData.has_solutions ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <Switch checked={formData.has_solutions}
                onCheckedChange={v => setFormData({ ...formData, has_solutions: v })} />
              <div>
                <div className="flex items-center gap-2">
                  <Lightbulb className={`w-4 h-4 ${formData.has_solutions ? "text-amber-600" : "text-slate-400"}`} />
                  <Label className="cursor-pointer">Çözümlü Test</Label>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Açıksa her soruya çözüm eklemeniz zorunludur.
                </p>
              </div>
            </div>
            {solutionStats && (
              <div className={`text-right shrink-0 ${
                solutionStats.done === solutionStats.total ? "text-emerald-600" : "text-amber-600"
              }`}>
                <p className="text-lg font-bold">{solutionStats.done}/{solutionStats.total}</p>
                <p className="text-xs">çözüm eklendi</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─── Sorular ─── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sorular ({questions.length})</CardTitle>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => { setNewQuestion(true); setEditingQuestion(null); }}>
              <Plus className="w-4 h-4 mr-2" />Soru Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Soru formu */}
          {(newQuestion || editingQuestion) && (
            <div className="mb-5">
              <QuestionForm
                question={editingQuestion}
                options={editingQuestion?.options || []}
                topicList={topicList}
                onSave={handleSaveQuestion}
                onCancel={() => { setNewQuestion(false); setEditingQuestion(null); }}
                isLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
                saveLabel={editingQuestion ? "Güncelle" : "Kaydet"}
              />
            </div>
          )}

          {/* Soru listesi */}
          <div className="space-y-3 mt-2">
            {currentQuestions.map((q, idx) => {
              const actualIdx     = startIndex + idx;
              const correctOpt    = q.options?.find(o => o.isCorrect);
              const correctLetter = correctOpt ? ["A","B","C","D","E"][q.options.indexOf(correctOpt)] : "-";
              const hasSol        = !!(q.solutionText?.trim() || q.solutionMediaUrl?.trim());
              return (
                <div key={q.id} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50">
                  <div className="flex items-center gap-2 text-slate-400 shrink-0">
                    <GripVertical className="w-5 h-5" />
                    <span className="font-semibold">{actualIdx + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 line-clamp-2">{q.content}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">Doğru: {correctLetter}</Badge>
                      {q.topic?.name && (
                        <Badge variant="outline" className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50">
                          {q.topic.name}
                        </Badge>
                      )}
                      {formData.has_solutions && (
                        hasSol
                          ? <Badge className="text-xs bg-emerald-100 text-emerald-700 border-0">
                              <CheckCircle2 className="w-3 h-3 mr-1" />Çözüm var
                            </Badge>
                          : <Badge className="text-xs bg-rose-100 text-rose-700 border-0">
                              <Lightbulb className="w-3 h-3 mr-1" />Çözüm eksik
                            </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm"
                    onClick={() => { setEditingQuestion(q); setNewQuestion(false); }}>
                    Düzenle
                  </Button>
                </div>
              );
            })}

            {questions.length === 0 && !newQuestion && (
              <div className="text-center py-12 text-slate-500">
                <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                Henüz soru eklenmedi
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}>Önceki</Button>
              <span className="py-2 px-4 text-sm text-slate-600">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}>Sonraki</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Aday önizleme modalı ─── */}
      <TestPreviewModal
        isOpen={previewOpen}
        questions={questions}
        title={formData?.title ?? ""}
        onClose={() => setPreviewOpen(false)}
        onConfirm={!formData?.is_published ? () => {
          setPreviewOpen(false);
          handleTogglePublish();
        } : null}
      />
    </div>
  );
}
