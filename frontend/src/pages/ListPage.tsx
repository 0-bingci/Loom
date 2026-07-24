import { useParams } from "react-router-dom";
import AllTasksPage from "./AllTasksPage";

/** /list/:id —— 复用"所有"页的任务表,过滤到单个清单。key 按 id 换,切清单时重置内部展开态。 */
export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  return <AllTasksPage key={id} listId={id} />;
}
