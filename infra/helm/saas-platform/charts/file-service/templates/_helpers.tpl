{{- define "file-service.name" -}}
{{- include "common.name" . }}
{{- end }}
{{- define "file-service.fullname" -}}
{{- include "common.fullname" . }}
{{- end }}
{{- define "file-service.labels" -}}
{{- include "common.labels" . }}
{{- end }}
{{- define "file-service.selectorLabels" -}}
{{- include "common.selectorLabels" . }}
{{- end }}
