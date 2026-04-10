// Atlas 스키마 관리 설정
// Design Ref: §2.1 | Plan SC: FR-N150.1

variable "db_password" {
  type    = string
  default = getenv("DB_PASSWORD")
}

env "dev" {
  src = "file://schema.sql"
  url = "postgres://app:dev@localhost:5432/saas_dev?sslmode=disable"
  dev = "docker://postgres/16/dev"
  migration {
    dir    = "file://migrations"
    format = atlas
  }
  lint {
    destructive {
      error = true
    }
    data_depend {
      error = true
    }
  }
}

env "stg" {
  src = "file://schema.sql"
  url = "postgres://app:${var.db_password}@postgres-stg:5432/saas_stg?sslmode=require"
  migration {
    dir    = "file://migrations"
    format = atlas
  }
  lint {
    destructive {
      error = true
    }
  }
}

env "prod" {
  src = "file://schema.sql"
  url = "postgres://app:${var.db_password}@postgres-prod:5432/saas_prod?sslmode=require"
  migration {
    dir             = "file://migrations"
    format          = atlas
    revisions_schema = "atlas_schema_revisions"
  }
  lint {
    destructive {
      error = true
    }
    data_depend {
      error = true
    }
  }
}
