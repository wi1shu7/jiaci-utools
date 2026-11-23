import { Book, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

function BookGroup({ title, books, bookId, busy, onSelect, showTitle = true }) {
  return (
    <section className="book-group" aria-label={title}>
      {showTitle && <h2>{title}</h2>}
      {books.length > 0 && (
        <ul role="list">
          {books.map((book) => (
            <li key={book.id}>
              <Button
                type="button" variant="ghost" className="book-item"
                aria-pressed={book.id === bookId} disabled={Boolean(busy)}
                title={`${book.name} · ${book.wordCount.toLocaleString()} 词`}
                onClick={() => onSelect(book.id)}
              >
                {book.id === bookId ? <BookOpen aria-hidden="true" /> : <Book aria-hidden="true" />}
                <span className="book-name">{book.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function BookLibrary({ state, scope, setScope, onSelect }) {
  const current = state.books.filter((book) => book.id === state.bookId)
  const mine = state.books.filter((book) => book.type !== "builtin" && book.id !== state.bookId)
  const other = state.books.filter((book) => book.type === "builtin")
  const shared = { bookId: state.bookId, busy: state.busy, onSelect }

  return (
    <Tabs value={scope} onValueChange={setScope} className="book-library" data-book-library>
      <TabsList variant="line" aria-label="词库范围" className="library-scopes">
        <TabsTrigger value="personal">常用词库</TabsTrigger>
        <TabsTrigger value="other">其他词库</TabsTrigger>
      </TabsList>
      <TabsContent value="personal" className="library-content">
        <BookGroup title="正在学习" books={current} {...shared} />
        <BookGroup title="我的词库" books={mine} {...shared} />
      </TabsContent>
      <TabsContent value="other" className="library-content">
        <BookGroup title="内置词库" books={other} showTitle={false} {...shared} />
      </TabsContent>
    </Tabs>
  )
}
