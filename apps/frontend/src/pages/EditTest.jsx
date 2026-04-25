import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import api from "@/api/dalClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, Save, Plus, GripVertical, BookOpen,
  Image, Lightbulb, Upload, X, Loader2, CheckCircle2
} from "lucide-react";
import { useServiceStatus } from "@/lib/useServiceStatus";

// ─── Image upload helper ──────────────────────────────────────────────────────
function ImageUploadButton({ value, onChange, label = "Görsel ekle" }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Sadece görsel dosyası yükleyebilirsiniz"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Dosya 5MB'dan küçük olmalı"); return; }
    if (ref.current) ref.current.value = "";
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url || data.fileUrl || data.file_url || "");
      toast.success("Görsel yüklendi");
    } catch {
      toast.error("Görsel yüklenemedi");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {value ? (
        <div className="relative">
          <img src={value} alt="solution" className="h-24 rounded-lg border object-contain bg-slate-50" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-rose-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {label}
        </button>
      )}
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Question form ─────────────────────────────────────────────────────────────
function QuestionForm({ question, options = [], hasSolutions = false, onSave, onCancel, isLoading }) {
  const letters = ["A", "B", "C", "D", "E"];
  const initOptions = (options || []).map(o => ({ id: o.id, content: o.content, isCorrect: o.isCorrect ?? o.is_correct }));
  while (initOptions.length < 5) initOptions.push({ content: "", isCorrect: false });

  const [data, setData] = useState(
    question
      ? {
          question_text: question.content,
          order: question.order ?? 0,
          options: initOptions,
          correct_answer: letters[initOptions.findIndex(o => o.isCorrect)] || "A",
          solutionText: question.solutionText || "",
          solutionMediaUrl: question.solutionMediaUrl || "",
        }
      : { question_text: "", order: 0, options: initOptions, correct_answer: "A", solutionText: "", solutionMediaUrl: "" }
  );

  const opts = data.options;

  const handleSave = () => {
    if (!data.question_text?.trim()) { toast.error("Soru metni girin"); return; }
    const hasA = (opts[0]?.content || "").trim();
    const hasB = (opts[1]?.content || "").trim();
    if (!hasA || !hasB) { toast.error("A ve B şıkları zorunludur"); return; }
    if (hasSolutions && !data.solutionText.trim() && !data.solutionMediaUrl.trim()) {
      toast.error("Bu test çözümlü — lütfen soru için bir çözüm ekleyin");
      return;
    }
    const finalOpts = opts
      .map((o, i) => ({ content: o.content || "", isCorrect: data.correct_answer === letters[i] }))
      .filter(o => o.content.trim());
    if (finalOpts.length < 2) { toast.error("En az 2 şık girin"); return; }
    onSave({
      question_text: data.question_text,
      order: data.order,
      correct_answer: data.correct_answer,
      options: finalOpts,
      solutionText: data.solutionText.trim() || null,
      solutionMediaUrl: data.solutionMediaUrl.trim() || null,
    });
  };

  return (
    <div className="border border-indigo-200 rounded-xl p-6 bg-indigo-50/50 mb-4">
      <h3 className="font-semibold text-slate-900 mb-4">{question ? "Soruyu Düzenle" : "Yeni Soru"}</h3>
      <div className="space-y-4">
        {/* Soru metni */}
        <div className="space-y-2">
          <Label>Soru Metni</Label>
          <Textarea
            value={data.question_text}
            onChange={e => setData({ ...data, question_text: e.target.value })}
            rows={3}
            placeholder="Soruyu buraya yazın..."
          />
        </div>

        {/* Şıklar */}
        <div className="grid grid-cols-1 gap-3">
          {letters.map((letter, i) => (
            <div key={letter} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-slate-200">
              <span className={`w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-sm font-bold
                ${data.correct_answer === letter ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                {letter}
              </span>
              <Input
                value={opts[i]?.content ?? ""}
                onChange={e => {
                  const next = opts.map((o, j) => j === i ? { ...o, content: e.target.value } : o);
                  setData({ ...data, options: next });
                }}
                placeholder={`${letter} şıkkı${i < 2 ? " *" : " (opsiyonel)"}`}
                className="border-0 shadow-none p-0 h-auto focus-visible:ring-0"
              />
              <button
                type="button"
                onClick={() => {
                  const next = opts.map((o, j) => ({ ...o, isCorrect: j === i }));
                  setData({ ...data, correct_answer: letter, options: next });
                }}
                className={`text-xs px-2 py-0.5 rounded shrink-0 ${
                  data.correct_answer === letter
                    ? "bg-emerald-100 text-emerald-700 font-semibold"
                    : "text-slate-400 hover:text-emerald-600"
                }`}
              >
                {data.correct_answer === letter ? "✓ Doğru" : "Doğru yap"}
              </button>
            </div>
          ))}
        </div>

        {/* Çözüm alanı */}
        {hasSolutions && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">
                Çözüm <span className="text-rose-500">*</span>
              </p>
              <span className="text-xs text-amber-600">(metin, URL veya görsel)</span>
            </div>
            <Textarea
              value={data.solutionText}
              onChange={e => setData({ ...data, solutionText: e.target.value })}
              placeholder="Çözüm metnini veya meeting/video URL'ini yazın..."
              rows={3}
            />
            <div>
              <p className="text-xs text-amber-700 mb-1.5">veya çözüm görseli yükleyin:</p>
              <ImageUploadButton
                value={data.solutionMediaUrl}
                onChange={url => setData({ ...data, solutionMediaUrl: url })}
                label="Çözüm görseli ekle"
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="outline" onClick={onCancel}>İptal</Button>
          <Button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
            {isLoading ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function EditTest() {
  const urlParams = new URLSearchParams(window.location.search);
  const testId = urlParams.get("id");
  const queryClient = useQueryClient();
  const { testPublishingEnabled } = useServiceStatus();

  const [formData, setFormData] = useState(null);
  const [originalFormData, setOriginalFormData] = useState(null);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [newQuestion, setNewQuestion] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 50;

  const { data: testDetail, isLoading } = useQuery({
    queryKey: ["test", testId],
    queryFn: async () => {
      const { data } = await api.get(`/tests/${testId}`);
      return data;
    },
    enabled: !!testId,
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ["examTypes"],
    queryFn: () => base44.entities.ExamType.filter({ is_active: true }),
  });

  const questions = testDetail?.questions || [];

  useEffect(() => {
    if (testDetail && !formData) {
      const fd = {
        title: testDetail.title,
        price: testDetail.priceCents != null ? testDetail.priceCents / 100 : 0,
        duration_minutes: testDetail.duration ?? 60,
        is_timed: !!testDetail.isTimed,
        has_solutions: !!testDetail.hasSolutions,
        exam_type_id: testDetail.examTypeId || "",
        topic_id: testDetail.topicId || "",
        is_published: !!testDetail.publishedAt,
      };
      setFormData(fd);
      setOriginalFormData(fd);
    }
  }, [testDetail]);

  const updateTestMutation = useMutation({
    mutationFn: async (data) => {
      await api.patch(`/tests/${testId}`, {
        title: data.title,
        priceCents: data.price != null ? Math.round(data.price * 100) : undefined,
        duration: data.duration_minutes,
        isTimed: data.is_timed,
        hasSolutions: data.has_solutions,
      });
      if (data.is_published != null) {
        if (data.is_published) await api.put(`/tests/${testId}/publish`);
        else await api.put(`/tests/${testId}/unpublish`);
      }
    },
    onSuccess: () => {
      toast.success("Test güncellendi");
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setOriginalFormData(formData);
    },
    onError: (err) => {
      const msg = err?.response?.data?.message ?? err?.message ?? "Güncelleme başarısız";
      toast.error(msg);
    },
  });

  const createQuestionMutation = useMutation({
    mutationFn: async (data) => {
      await api.post(`/tests/${testId}/questions`, {
        content: data.question_text,
        order: questions.length,
        options: data.options,
        solutionText: data.solutionText ?? null,
        solutionMediaUrl: data.solutionMediaUrl ?? null,
      });
    },
    onSuccess: () => {
      toast.success("Soru eklendi");
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setNewQuestion(false);
      setEditingQuestion(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Soru eklenemedi");
    },
  });

  const updateQuestionMutation = useMutation({
    mutationFn: ({ questionId, data }) =>
      api.patch(`/tests/${testId}/questions/${questionId}`, {
        content: data.question_text,
        order: data.order,
        solutionText: data.solutionText ?? null,
        solutionMediaUrl: data.solutionMediaUrl ?? null,
      }),
    onSuccess: () => {
      toast.success("Soru güncellendi");
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
      setEditingQuestion(null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message ?? "Güncelleme başarısız");
    },
  });

  const updateOptionMutation = useMutation({
    mutationFn: ({ questionId, optionId, data }) =>
      api.patch(`/tests/${testId}/questions/${questionId}/options/${optionId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test", testId] });
    },
  });

  const handleSaveTest = () => updateTestMutation.mutate({ ...formData, is_published: null });

  const handleTogglePublish = () => {
    // Kill-switch: test publishing disabled
    if (!testPublishingEnabled && !formData.is_published) {
      toast.warning("Test yayınlama geçici olarak durdurulmuştur. Lütfen daha sonra tekrar deneyin.");
      return;
    }
    if (questions.length === 0 && !formData.is_published) {
      toast.error("Yayınlamak için en az 1 soru ekleyin");
      return;
    }
    // Frontend guard: if hasSolutions, check all questions have solutions
    if (formData.has_solutions && !formData.is_published) {
      const missing = questions.filter(q => !q.solutionText?.trim() && !q.solutionMediaUrl?.trim());
      if (missing.length > 0) {
        toast.error(`${missing.length} soru için çözüm eksik. Çözümlü testlerde tüm sorulara çözüm eklenmesi zorunludur.`);
        return;
      }
    }
    const newVal = !formData.is_published;
    setFormData({ ...formData, is_published: newVal });
    updateTestMutation.mutate({ ...formData, is_published: newVal });
  };

  if (isLoading || !formData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const hasChanges = originalFormData && formData && JSON.stringify(originalFormData) !== JSON.stringify(formData);
  const totalPages = Math.ceil(questions.length / questionsPerPage);
  const startIndex = (currentPage - 1) * questionsPerPage;
  const currentQuestions = questions.slice(startIndex, startIndex + questionsPerPage);

  // Solution coverage stats
  const solutionStats = formData.has_solutions ? {
    total: questions.length,
    done: questions.filter(q => q.solutionText?.trim() || q.solutionMediaUrl?.trim()).length,
  } : null;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Link to={createPageUrl("MyTestPackages")} className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          Test Paketlerime Dön
        </Link>
        <div className="flex items-center gap-4">
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
          <Button
            onClick={handleSaveTest}
            disabled={updateTestMutation.isPending || !hasChanges}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Kaydet
          </Button>
        </div>
      </div>

      {/* Test Bilgileri */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Bilgileri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Başlık</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Sınav Türü</Label>
              <Select
                value={formData.exam_type_id || ""}
                onValueChange={v => setFormData({ ...formData, exam_type_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                <SelectContent>
                  {examTypes.map(exam => (
                    <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fiyat (₺)</Label>
              <Input
                type="number" min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Süre (dakika)</Label>
              <Input
                type="number" min="1"
                value={formData.duration_minutes}
                onChange={e => setFormData({ ...formData, duration_minutes: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_timed}
                onCheckedChange={v => setFormData({ ...formData, is_timed: v })}
              />
              <Label>Süreli test</Label>
            </div>
          </div>

          {/* Çözümlü toggle */}
          <div className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
            formData.has_solutions ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"
          }`}>
            <div className="flex items-center gap-3 flex-1">
              <Switch
                checked={formData.has_solutions}
                onCheckedChange={v => setFormData({ ...formData, has_solutions: v })}
              />
              <div>
                <div className="flex items-center gap-2">
                  <Lightbulb className={`w-4 h-4 ${formData.has_solutions ? "text-amber-600" : "text-slate-400"}`} />
                  <Label className="cursor-pointer">Çözümlü Test</Label>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Açıksa her soruya çözüm eklemeniz zorunludur. Adaylar testi bitirdikten sonra çözümleri görebilir.
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

      {/* Sorular */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Sorular ({questions.length})</CardTitle>
            <Button
              onClick={() => { setNewQuestion(true); setEditingQuestion(null); }}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Soru Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(newQuestion || editingQuestion) && (
            <QuestionForm
              question={editingQuestion}
              options={editingQuestion?.options || []}
              hasSolutions={formData.has_solutions}
              onSave={data => {
                if (editingQuestion) {
                  updateQuestionMutation.mutate({ questionId: editingQuestion.id, data });
                  // Update options that changed
                  (data.options || []).forEach((opt, i) => {
                    const orig = editingQuestion.options?.[i];
                    if (orig && (opt.content !== orig.content || opt.isCorrect !== orig.isCorrect)) {
                      updateOptionMutation.mutate({
                        questionId: editingQuestion.id,
                        optionId: orig.id,
                        data: { content: opt.content, isCorrect: opt.isCorrect },
                      });
                    }
                  });
                } else {
                  createQuestionMutation.mutate(data);
                }
              }}
              onCancel={() => { setNewQuestion(false); setEditingQuestion(null); }}
              isLoading={createQuestionMutation.isPending || updateQuestionMutation.isPending}
            />
          )}

          <div className="space-y-3 mt-2">
            {currentQuestions.map((q, idx) => {
              const actualIdx = startIndex + idx;
              const correctOpt = q.options?.find(o => o.isCorrect);
              const correctLetter = correctOpt ? ["A","B","C","D","E"][q.options.indexOf(correctOpt)] : "-";
              const hasSol = !!(q.solutionText?.trim() || q.solutionMediaUrl?.trim());
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
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setEditingQuestion(q); setNewQuestion(false); }}
                  >
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
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Önceki</Button>
              <span className="py-2 px-4 text-sm text-slate-600">{currentPage} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Sonraki</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
