{{- define "postgres.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "postgres.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "postgres.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "postgres.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
