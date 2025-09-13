import { useEffect, useState } from "react";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Paper, Typography } from "@mui/material";
import { api } from "../lib/apiClient";

type Student = { id: string; first_name: string; family_name: string; born_date: string };

const columns: GridColDef[] = [
  { field: "id", headerName: "ID", width: 120 },
  { field: "family_name", headerName: "Family Name", flex: 1 },
  { field: "first_name", headerName: "First Name", flex: 1 },
  { field: "born_date", headerName: "Born", width: 140 },
];

export default function StudentsPage() {
  const [rows, setRows] = useState<Student[]>([]);
  useEffect(() => {
    api.get("/api/students/?page_size=50").then(r => {
      const data = r.data.results ?? r.data;
      setRows(data);
    });
  }, []);

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Students</Typography>
      <div style={{ height: 600, width: "100%" }}>
        <DataGrid rows={rows} columns={columns} getRowId={(r) => r.id} pageSizeOptions={[25,50,100]} />
      </div>
    </Paper>
  );
}
