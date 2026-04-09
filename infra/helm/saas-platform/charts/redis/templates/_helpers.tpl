{{- define "redis.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "redis.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "redis.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "redis.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
