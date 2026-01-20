import * as React from "react"
import { Check, ChevronsUpDown, Search, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function toUpperWithoutAccents(str: string): string {
  return removeAccents(str).toUpperCase()
}

interface SearchableSelectProps {
  value: string
  onValueChange: (value: string) => void
  options: string[]
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  allowCustom?: boolean
  "data-testid"?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhum resultado encontrado.",
  disabled = false,
  className,
  allowCustom = true,
  "data-testid": testId,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const normalizedSearch = toUpperWithoutAccents(searchValue.trim())

  const handleSelectCustom = () => {
    if (normalizedSearch) {
      onValueChange(normalizedSearch)
      setOpen(false)
      setSearchValue("")
    }
  }

  const filteredOptions = options.filter(option => 
    option.toLowerCase().includes(searchValue.toLowerCase())
  )

  const showCustomOption = allowCustom && normalizedSearch && 
    !options.some(opt => opt.toLowerCase() === normalizedSearch.toLowerCase())

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) setSearchValue("")
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          data-testid={testId}
        >
          <span className="truncate">
            {value || placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <Search className="h-4 w-4 opacity-50" />
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder={searchPlaceholder} 
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !showCustomOption && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            {showCustomOption && (
              <CommandGroup heading="Valor personalizado">
                <CommandItem
                  value={`__custom__${normalizedSearch}`}
                  onSelect={handleSelectCustom}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Usar "{normalizedSearch}"
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onValueChange(option)
                    setOpen(false)
                    setSearchValue("")
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
